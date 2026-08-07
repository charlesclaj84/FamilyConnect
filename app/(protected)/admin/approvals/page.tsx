import { redirect } from 'next/navigation'

/**
 * Member Approvals moved into Members & Access as its "Pending Approval" tab.
 *
 * The route stays as a redirect rather than being deleted, because the queue is
 * linked to from outside this codebase's control: the notification a pending member
 * receives, invitation emails, and whatever an administrator has bookmarked. A 404
 * would strand all of them.
 *
 * NOT gated, and it does not need to be. It reads nothing and renders nothing — it
 * only rewrites a URL, and the destination gates itself on the same two resource keys
 * it always did. Checking a grant here would be checking it twice and getting the
 * worse error: a 404 from this route tells a caller the page does not exist, when
 * what is true is that the page moved.
 *
 * The resource key `admin/approvals` is unaffected and still governs the tab, the
 * server actions and the RLS on the rows behind them. It is registered in
 * `lib/features.ts` and `permission_resources`, and both entries stay — the key is
 * what administrators grant on Members & Access, and removing either would drop it
 * out of `viewableResources()` and out of the permission grid.
 */
export default async function AdminApprovalsPage() {
  redirect('/admin/users?tab=approvals')
}
