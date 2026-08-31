import { requireStaff } from '@/lib/auth/staff'
import { listStaffFamilies } from '@/app/actions/staff/families'
import { StaffFamiliesClient } from '@/components/staff/StaffFamiliesClient'
import { PageShell } from '@/components/layout/PageShell'
import { MEMBER_PAGE_SIZE } from '@/lib/pagination'
import { callerI18n } from '@/lib/i18n/server'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./staff/families.title')
}

/**
 * Every family on the platform, and the one thing this console can change about one.
 *
 * ── THE GUARD, AGAIN ───────────────────────────────────────────────────────────────
 * `requireStaff()` here as well as in the layout and again inside `listStaffFamilies`.
 * AGENTS.md §1 and §2 are the same argument twice: the layout is not in the request path
 * of a server action, and the page is not in the request path of one either. Each gates
 * itself; the reads are memoized so the three calls cost one query.
 *
 * ── THE FIRST PAGE IS FETCHED HERE, WHICH IS §5 RATHER THAN AN OPTIMIZATION ────────
 * Props are serialized into the RSC payload whether a component renders them or not, so a
 * page that fetched the platform and let the client decide what to show would have
 * published the platform. The fetch is behind the same gate as the screen, and the client
 * component below re-asks the server for every later page rather than being handed the
 * rest of them up front.
 *
 * `MEMBER_PAGE_SIZE` is the limit because `Pager` — the shared control the client
 * reuses — derives its page count from that constant. A different limit here would
 * produce a pager confidently claiming the wrong number of pages.
 *
 * No `permission_resources` row governs this page, and none may — see
 * `app/(staff)/layout.tsx` and `lib/auth/staff.ts` for why staffness is deliberately
 * outside the family permission model.
 */
export default async function StaffFamiliesPage() {
  const { t } = await callerI18n(null)
  // THE ROLE, not just staffness. `requireStaff()` already returns the caller; reading its
  // `role` here is what decides whether the permanent-delete control is rendered at all —
  // and it is resolved on the server because `genorra_staff` has RLS with no policies, so
  // the browser cannot answer it. See `StaffFamiliesClient`'s `isOwner` prop.
  const staff = await requireStaff()

  const initial = await listStaffFamilies({ offset: 0, limit: MEMBER_PAGE_SIZE })

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold">{t('page./staff/families.title')}</h1>
        <p className="max-w-3xl text-muted-foreground">{t('stf.everyFamilyPlatformWhatever')}</p>
      </div>

      <StaffFamiliesClient initial={initial} isOwner={staff.role === 'owner'} />
    </PageShell>
  )
}
