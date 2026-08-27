import { requireStaff } from '@/lib/auth/staff'
import { listStaffAccounts } from '@/app/actions/staff/accounts'
import { StaffAccountsClient } from '@/components/staff/StaffAccountsClient'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'

export const metadata = { title: 'Accounts' }

/**
 * Every sign-in account on the platform, and what is stopping any one of them signing in.
 *
 * ── WHY THIS SCREEN EXISTS SEPARATELY FROM FAMILIES ────────────────────────────────
 * "They say they cannot sign in" is not a question about a family. The four things that
 * cause it live in four different places, and no screen in the member product can see
 * more than one of them:
 *
 *   * no account with that address at all — GoTrue;
 *   * an account whose address was never confirmed — GoTrue;
 *   * an account belonging to no family, which 404s every page — `people`;
 *   * a membership that is pending, or a family that has been removed — `people` and
 *     `families`, and the removed case is invisible from the member's side entirely.
 *
 * This page puts all four in one answer. The lookup control does it for one address; the
 * table browses.
 *
 * ── THE GUARD, AND THE FETCH ───────────────────────────────────────────────────────
 * `requireStaff()` here, in the layout above, and first thing inside every action — the
 * layout is not in a server action's request path and neither is this page (AGENTS.md §1,
 * §2). The first page is fetched here rather than by the client on mount, so the fetch
 * sits behind the same gate as the screen (§5); every later page goes back to the server
 * action, because paging a platform in the browser is not paging.
 *
 * No `permission_resources` row governs this page and none may — see `lib/auth/staff.ts`.
 */
export default async function StaffAccountsPage() {
  const { t } = await callerI18n(null)
  await requireStaff()

  const initial = await listStaffAccounts({ page: 1 })

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Accounts</h1>
        <p className="max-w-3xl text-muted-foreground">{t('stf.everyAccountCanSign')}</p>
      </div>

      <StaffAccountsClient initial={initial} />
    </PageShell>
  )
}
