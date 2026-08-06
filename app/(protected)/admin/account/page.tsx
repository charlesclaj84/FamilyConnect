import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { getDuesSchedules } from '@/app/actions/dues'
import { getFunds, getFundAllocations } from '@/app/actions/funds'
import { AdminAccountShell } from '@/components/admin/AdminAccountShell'
import { resolveSection } from '@/components/admin/account-sections'

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

  const [schedules, fundsData, allocations, milestonesResult] = await Promise.all([
    getDuesSchedules(),
    getFunds(),
    getFundAllocations(),
    // Family-scoped explicitly: the service-role client does not apply RLS.
    admin.from('fund_milestones').select('*').eq('family_code', familyCode).order('sort_order'),
  ])

  // Widened only at xl, where the rail appears: every narrower width keeps the
  // measure the rest of the admin pages use.
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 xl:max-w-6xl">
      <h1 className="text-3xl font-bold">Accounting</h1>

      <AdminAccountShell
        initialSection={initialSection}
        initialSchedules={schedules}
        initialFunds={fundsData}
        allMilestones={milestonesResult.data ?? []}
        initialAllocations={allocations}
      />
    </div>
  )
}
