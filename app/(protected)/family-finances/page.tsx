import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, requireView } from '@/lib/auth/permissions'
import { getFamilyPnL } from '@/app/actions/dues'
import { getFunds } from '@/app/actions/funds'
import { AccountPnLCard } from '@/components/account/AccountPnLCard'
import { FundsSection } from '@/components/account/FundsSection'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Family Finances' }

export default async function FamilyFinancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'family-finances')

  const [pnlData, funds] = await Promise.all([
    getFamilyPnL(),
    getFunds(),
  ])

  return (
    <PageShell className="space-y-10">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Family Finances</h1>
        <p className="text-muted-foreground">Family-wide income, expenses, net balance, and funds.</p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">P&amp;L Summary</h2>
          <p className="text-sm text-muted-foreground">Family-wide income, expenses, and net balance.</p>
        </div>
        <AccountPnLCard data={pnlData} />
      </section>

      <section>
        <FundsSection funds={funds} isAdmin={await can(user.id, 'family-finances', 'edit')} />
      </section>
    </PageShell>
  )
}
