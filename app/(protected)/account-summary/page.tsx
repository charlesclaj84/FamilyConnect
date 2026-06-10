import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyDuesSummary, getMyPaymentHistory } from '@/app/actions/dues'
import { DuesDetailSection } from '@/components/account/DuesDetailSection'

export const metadata = { title: 'Account Summary — Family Connect' }

export default async function AccountSummaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [duesSummary, paymentHistory] = await Promise.all([
    getMyDuesSummary(),
    getMyPaymentHistory(),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">Account Summary</h1>
        <p className="text-muted-foreground">Your dues status, payment history, and outstanding amounts.</p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">My Dues</h2>
          <p className="text-sm text-muted-foreground">Your personal dues status, payment history, and outstanding amounts.</p>
        </div>
        <DuesDetailSection summary={duesSummary} history={paymentHistory} />
      </section>
    </div>
  )
}
