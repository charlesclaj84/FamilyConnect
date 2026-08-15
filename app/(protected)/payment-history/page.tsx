import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyPaymentHistory } from '@/app/actions/dues'
import { PaymentHistorySection } from '@/components/account/PaymentHistorySection'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Payment History' }

/**
 * Every payment the family has recorded against this member — dues and donations alike,
 * with reversals kept as their own entries rather than erasing what they correct.
 *
 * A PANE OF /account-summary UNTIL 20260815000000. `account-summary/history` became
 * `payment-history`; see [Dues](/dues) for the argument, which is the same one.
 *
 * OWN-ONLY BY CONSTRUCTION, and not by grant. getMyPaymentHistory() filters
 * `.eq('person_id', myPersonId)` in the action, and the `dues_payments` SELECT policy
 * admits a member their own rows unconditionally — the clause 20260808000001 §1 marks
 * as "must not be removed" and 20260815000000 §5h re-asserts. Whether this member may
 * see ANYBODY ELSE's payments is a different question, asked on a different screen, by
 * the two `transactions/*` ledger keys.
 */
export default async function PaymentHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'payment-history')

  const history = await getMyPaymentHistory()

  return (
    <PageShell className="space-y-8">
      <h1 className="text-3xl font-bold">Payment History</h1>
      <PaymentHistorySection history={history} />
    </PageShell>
  )
}
