import { redirect } from 'next/navigation'
import { requireView } from '@/lib/auth/permissions'
import { resolveZone } from '@/lib/auth/zone'
import { getMyPaymentHistory } from '@/app/actions/dues'
import { PaymentHistorySection } from '@/components/account/PaymentHistorySection'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./accounting/payment-history.title')
}

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
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'accounting/payment-history')

  const { t } = await callerI18n(user.id)

  // Resolved once per request (`resolveZone` is React-`cache`d) and handed down, so the
  // instants on this screen are read in the member's own zone rather than the server's.
  const [history, zone] = await Promise.all([
    getMyPaymentHistory(),
    resolveZone(user.id),
  ])

  return (
    <PageShell className="space-y-8">
      <h1 className="text-3xl font-bold">{t('page./accounting/payment-history.title')}</h1>
      <PaymentHistorySection history={history} zone={zone} />
    </PageShell>
  )
}
