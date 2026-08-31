import { requireStaff } from '@/lib/auth/staff'
import { listStaffSubscriptions } from '@/app/actions/staff/subscriptions'
import { StaffSubscriptionsClient } from '@/components/staff/StaffSubscriptionsClient'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('staff.subscriptions')
}

/**
 * What the platform is being paid, across every family.
 *
 * ── THE GUARD, AGAIN, AND `requireStaff` RATHER THAN OWNER ─────────────────────────
 * `requireStaff()` here as well as in the layout and again inside `listStaffSubscriptions`.
 * AGENTS.md §1 and §2 are the same argument twice: the layout is not in the request path of a
 * server action, and the page is not in the request path of one either.
 *
 * Not `requireStaffOwner()`: this screen destroys nothing, and "are they actually paying?" is
 * where most support conversations start. `owner` is the line for irreversible acts.
 *
 * ── FETCHED HERE, WHICH IS §5 RATHER THAN AN OPTIMIZATION ──────────────────────────
 * Props are serialized into the RSC payload whether a component renders them or not, so a
 * page that handed the platform's whole billing state to a client component and let it decide
 * what to show would have published it. The fetch is behind the same gate as the screen.
 *
 * ── NOT PAGED, DELIBERATELY, AND THIS IS THE ONE STAFF SCREEN THAT ISN'T ───────────
 * Families and Accounts both page, because both grow with the platform and neither has a
 * total worth summing. This one is a list of CUSTOMERS with a summary above it, and a paged
 * summary is either wrong or a second query — so it reads the whole billing table, which has
 * one row per family that has ever reached checkout and is therefore the smallest of the
 * three by construction. If it ever stops being small, the summary moves into SQL before the
 * list gets a pager.
 */
export default async function StaffSubscriptionsPage() {
  const { t } = await callerI18n(null)
  await requireStaff()

  const data = await listStaffSubscriptions()

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold">{t('staff.subscriptions')}</h1>
        <p className="max-w-3xl text-muted-foreground">{t('stf.subscriptionsLede')}</p>
      </div>

      <StaffSubscriptionsClient data={data} />
    </PageShell>
  )
}
