import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { getDuesSchedules, getAllDuesPayments } from '@/app/actions/dues'
import { getFunds, getAllDisbursements, getFundAllocations } from '@/app/actions/funds'
import { AdminAccountShell } from '@/components/admin/AdminAccountShell'
import { resolveSection } from '@/components/admin/account-sections'

export const metadata = { title: 'Accounting — Admin — Family Connect' }

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

  const [schedules, payments, fundsData, allDisbursements, allocations, membersResult] = await Promise.all([
    getDuesSchedules(),
    getAllDuesPayments(),
    getFunds(),
    getAllDisbursements(),
    getFundAllocations(),
    admin
      .from('people')
      .select('id, first_name, last_name, nick_name, date_of_birth')
      .eq('family_code', familyCode)
      .eq('is_minor', false)
      .not('user_id', 'is', null)
      .order('last_name'),
  ])

  const members = (membersResult.data ?? []).map(m => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    nick_name: m.nick_name ?? null,
    date_of_birth: m.date_of_birth ?? null,
  }))

  // Collect all milestones for all funds in one go
  const fundIds = fundsData.map(f => f.id)
  const milestonesResult = fundIds.length
    ? await admin.from('fund_milestones').select('*').in('fund_id', fundIds).order('sort_order')
    : { data: [] }
  const allMilestones = milestonesResult.data ?? []

  // Widened only at xl, where the rail appears: every narrower width keeps the
  // measure the rest of the admin pages use.
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 xl:max-w-6xl">
      <h1 className="text-3xl font-bold">Accounting</h1>

      <AdminAccountShell
        initialSection={initialSection}
        initialSchedules={schedules}
        initialPayments={payments}
        initialFunds={fundsData}
        allMilestones={allMilestones}
        allDisbursements={allDisbursements}
        initialAllocations={allocations}
        members={members}
      />
    </div>
  )
}
