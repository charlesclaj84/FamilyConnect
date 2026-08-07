import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { getDuesSchedules, getScheduleUsage } from '@/app/actions/dues'
import { getFunds, getFundAllocations } from '@/app/actions/funds'
import { AdminAccountShell } from '@/components/admin/AdminAccountShell'
import {
  resolveSection, SECTION_RESOURCE,
  type AccountSection, type AccountRights, type SectionRights,
} from '@/components/admin/account-sections'
import { can, canAny } from '@/lib/auth/permissions'

export const metadata = { title: 'Accounting — Admin — Family Connect' }

/**
 * Accounting CONFIGURATION: dues, donations, funds, routing, milestones, settings.
 *
 * The ledgers and the forms that write to them used to load here too — that is why
 * this page once fetched payments, disbursements, contributions and the member list.
 * They live on /transactions now, so none of it is read twice.
 */
export default async function AdminAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  await requireView(user.id, 'admin/account')

  const familyCode = await getMyFamilyCode(user.id)

  // Resolved server-side so the first paint already shows the right section — and so
  // the client's initial state matches the server HTML exactly, which is what keeps
  // this free of hydration mismatch. searchParams is a Promise in Next 16.
  const initialSection = resolveSection((await searchParams).section)

  // One set of rights per section. requireView('admin/account') above only says the
  // caller may open the page at all; each rail, each section and each new/edit/delete
  // inside it is its own grant, so someone can maintain the dues schedule without also
  // being able to redraw the routing split or price a milestone.
  //
  // view uses can() — 'own' is a real way to hold view. Everything that WRITES uses
  // canAny(): this is family-wide configuration with no coherent "own" version, which
  // is exactly the case AGENTS.md reserves canAny for.
  const SECTIONS: AccountSection[] = ['dues', 'donations', 'funds', 'routing', 'milestones', 'processing', 'bank']
  const rightsList = await Promise.all(
    SECTIONS.map(async (s): Promise<[AccountSection, SectionRights]> => {
      const resource = SECTION_RESOURCE[s]
      const [view, create, edit, del] = await Promise.all([
        can(user.id, resource, 'view'),
        canAny(user.id, resource, 'create'),
        canAny(user.id, resource, 'edit'),
        canAny(user.id, resource, 'delete'),
      ])
      return [s, { view, create, edit, delete: del }]
    }),
  )
  const rights = Object.fromEntries(rightsList) as AccountRights

  // Gate the FETCH, not just the pane. Props are serialized into the RSC payload and
  // reach the browser whether or not a component renders them, so loading the funds or
  // the dues schedules for someone who may not see that section would publish them
  // regardless of which pane is showing (AGENTS.md §4).
  const [schedules, scheduleUsage, fundsData, allocations, milestonesResult] = await Promise.all([
    rights.dues.view || rights.donations.view ? getDuesSchedules() : Promise.resolve([]),
    // Gated on the same pair as the schedules themselves: it says which of them the
    // ledger has been posted against, which is only meaningful beside the list.
    rights.dues.view || rights.donations.view ? getScheduleUsage() : Promise.resolve({}),
    rights.funds.view || rights.routing.view || rights.milestones.view ? getFunds() : Promise.resolve([]),
    rights.routing.view ? getFundAllocations() : Promise.resolve([]),
    // Family-scoped explicitly: the service-role client does not apply RLS.
    rights.milestones.view
      ? admin.from('fund_milestones').select('*').eq('family_code', familyCode).order('sort_order')
      : Promise.resolve({ data: [] }),
  ])

  // Widened only at xl, where the rail appears: every narrower width keeps the
  // measure the rest of the admin pages use.
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 xl:max-w-6xl">
      <h1 className="text-3xl font-bold">Accounting</h1>

      <AdminAccountShell
        initialSection={initialSection}
        initialSchedules={schedules}
        scheduleUsage={scheduleUsage}
        initialFunds={fundsData}
        allMilestones={milestonesResult.data ?? []}
        initialAllocations={allocations}
        rights={rights}
      />
    </div>
  )
}
