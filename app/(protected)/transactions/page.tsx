import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode, getMyPersonId } from '@/lib/auth/family'
import { canAny, scopeFor, requireView } from '@/lib/auth/permissions'
import { getDuesSchedules, getAllDuesPayments } from '@/app/actions/dues'
import { getFunds, getAllDisbursements, getFundContributions } from '@/app/actions/funds'
import { TransactionsClient } from '@/components/transactions/TransactionsClient'
import { resolveLedger } from '@/components/transactions/ledgers'

export const metadata = { title: 'Transactions — Family Connect' }

/**
 * Every transaction the family has recorded: dues in, donations in, contributions
 * into funds, disbursements out.
 *
 * NOT an admin page — that was the point of moving it off /admin/account. Three
 * separate gates, because "can see the page" and "can move money" are different
 * questions:
 *
 *   1. requireView('transactions') — 404s anyone the family has restricted.
 *   2. RLS on every read below, so a member whose `dues` view is scoped to 'own' sees
 *      their own payments and not the family's.
 *   3. The record permissions, resolved here so the buttons and the server actions
 *      can never disagree:
 *        dues edit            → may record a dues or donation payment (scope 'own'
 *                               means only their own, which the form honours)
 *        family-finances edit → may record money into or out of a fund. canAny: a
 *                               disbursement a member would "own" is one paying
 *                               themselves.
 *
 * A member with neither edit grant sees four read-only ledgers.
 */
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'transactions')

  const admin = createAdminClient()
  const familyCode = await getMyFamilyCode(user.id)

  // Resolved server-side so the first paint already shows the right ledger, and so
  // the client's initial state matches the server HTML exactly — which is what keeps
  // this free of hydration mismatch. searchParams is a Promise in Next 16.
  const initialLedger = resolveLedger((await searchParams).ledger)

  const [
    schedules, payments, fundsData, disbursements, contributions,
    paymentScope, canRecordFunds, myPersonId,
  ] = await Promise.all([
    getDuesSchedules(),
    getAllDuesPayments(),
    getFunds(),
    getAllDisbursements(),
    getFundContributions(),
    scopeFor(user.id, 'dues', 'edit'),
    canAny(user.id, 'family-finances', 'edit'),
    getMyPersonId(user.id),
  ])
  const canRecordPayments = paymentScope !== 'none'

  // How much of the roster this caller is entitled to see, which is NOT the same as
  // whether a button renders. Props reach the browser whether or not the component
  // renders them, so gating only the affordance would hand every viewer the family's
  // roster in the RSC payload — and a member whose dues-edit grant is scoped to 'own'
  // may record only for themselves, so one row is all they can use.
  const roster: 'all' | 'self' | 'none' =
    canRecordFunds || paymentScope === 'any' ? 'all'
      : paymentScope === 'own' ? 'self'
        : 'none'

  // Adults only, matching every other member picker. Family-scoped explicitly: the
  // service-role client does not apply RLS.
  const membersQuery = admin
    .from('people')
    .select('id, first_name, last_name, nick_name, date_of_birth')
    .eq('family_code', familyCode)
    .eq('is_minor', false)
    .not('user_id', 'is', null)
    .order('last_name')

  const [membersResult, milestonesResult] = await Promise.all([
    roster === 'all' ? membersQuery
      : roster === 'self' && myPersonId ? membersQuery.eq('id', myPersonId)
        : Promise.resolve({ data: [] }),
    // Only the disbursement form uses these.
    canRecordFunds
      ? admin.from('fund_milestones').select('*').eq('family_code', familyCode).order('sort_order')
      : Promise.resolve({ data: [] }),
  ])

  const members = (membersResult.data ?? []).map(m => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    nick_name: m.nick_name ?? null,
    date_of_birth: m.date_of_birth ?? null,
  }))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 xl:max-w-6xl">
      <h1 className="text-3xl font-bold">Transactions</h1>

      <TransactionsClient
        initialLedger={initialLedger}
        initialPayments={payments}
        initialContributions={contributions}
        initialDisbursements={disbursements}
        schedules={schedules}
        funds={fundsData.map(f => ({ id: f.id, name: f.name }))}
        milestones={milestonesResult.data ?? []}
        members={members}
        canRecordPayments={canRecordPayments}
        canRecordFunds={canRecordFunds}
      />
    </div>
  )
}
