import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyDuesSummary, getMyPaymentHistory, getFamilyPnL } from '@/app/actions/dues'
import { getFunds } from '@/app/actions/funds'
import { createAdminClient } from '@/lib/supabase/admin'
import { AccountPnLCard } from '@/components/account/AccountPnLCard'
import { FundsSection } from '@/components/account/FundsSection'
import { DuesDetailSection } from '@/components/account/DuesDetailSection'

export const metadata = { title: 'Account — Family Connect' }

export default async function AccountSummaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: myPerson } = await admin
    .from('people')
    .select('id, is_admin')
    .eq('user_id', user.id)
    .maybeSingle()

  const [duesSummary, paymentHistory, pnlData, funds] = await Promise.all([
    getMyDuesSummary(),
    getMyPaymentHistory(),
    getFamilyPnL(),
    getFunds(),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">Account Summary</h1>
        <p className="text-muted-foreground">View your dues history, outstanding balance, and family finances.</p>
      </div>

      {/* Personal dues — full detail view */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">My Dues</h2>
          <p className="text-sm text-muted-foreground">Your personal dues status, payment history, and outstanding amounts.</p>
        </div>
        <DuesDetailSection summary={duesSummary} history={paymentHistory} />
      </section>

      {/* Family P&L */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Family Finances</h2>
          <p className="text-sm text-muted-foreground">Family-wide income, expenses, and net balance summary.</p>
        </div>
        <AccountPnLCard data={pnlData} />
      </section>

      {/* Funds */}
      <section>
        <FundsSection funds={funds} isAdmin={!!myPerson?.is_admin} />
      </section>
    </div>
  )
}
