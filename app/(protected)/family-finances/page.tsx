import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFamilyPnL } from '@/app/actions/dues'
import { getFunds } from '@/app/actions/funds'
import { AccountPnLCard } from '@/components/account/AccountPnLCard'
import { FundsSection } from '@/components/account/FundsSection'

export const metadata = { title: 'Family Finances — Family Connect' }

export default async function FamilyFinancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: myPerson } = await admin
    .from('people')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle()

  const [pnlData, funds] = await Promise.all([
    getFamilyPnL(),
    getFunds(),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">Family Finances</h1>
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
        <FundsSection funds={funds} isAdmin={!!myPerson?.is_admin} />
      </section>
    </div>
  )
}
