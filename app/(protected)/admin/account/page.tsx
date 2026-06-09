import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDuesSchedules, getAllDuesPayments } from '@/app/actions/dues'
import { getFunds, getAllDisbursements } from '@/app/actions/funds'
import { AdminDuesClient } from '@/components/admin/AdminDuesClient'
import { AdminFundsClient } from '@/components/admin/AdminFundsClient'

export const metadata = { title: 'Account Management — Admin — Family Connect' }

export default async function AdminAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: myPerson } = await admin
    .from('people')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myPerson?.is_admin) redirect('/dashboard')

  const familyCode: string = user.user_metadata?.family_code ?? ''

  const [schedules, payments, fundsData, allDisbursements, membersResult] = await Promise.all([
    getDuesSchedules(),
    getAllDuesPayments(),
    getFunds(),
    getAllDisbursements(),
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-1">Account Management</h1>
        <p className="text-muted-foreground">Manage dues schedules, record payments, and administer family funds.</p>
      </div>

      <AdminDuesClient
        initialSchedules={schedules}
        initialPayments={payments}
        members={members}
      />

      <div className="border-t pt-8">
        <AdminFundsClient
          initialFunds={fundsData}
          allMilestones={allMilestones}
          allDisbursements={allDisbursements}
          members={members}
        />
      </div>
    </div>
  )
}
