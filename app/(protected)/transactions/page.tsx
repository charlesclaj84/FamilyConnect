import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { can, canAny, requireView } from '@/lib/auth/permissions'
import { getDuesSchedules, getAllDuesPayments } from '@/app/actions/dues'
import { getFunds, getAllDisbursements, getFundContributions } from '@/app/actions/funds'
import { TransactionsClient } from '@/components/transactions/TransactionsClient'
import {
  LEDGERS, resolveLedger, LEDGER_RESOURCE, REVERSAL_RESOURCE, type Ledger,
} from '@/components/transactions/ledgers'

export const metadata = { title: 'Transactions — Family Connect' }

/**
 * Every transaction the family has recorded: dues in, donations in, contributions
 * into funds, disbursements out.
 *
 * NOT an admin page — that was the point of moving it off /admin/account. Four
 * separate gates, because "can see the page", "can see this ledger" and "can move
 * money" are three different questions:
 *
 *   1. requireView('transactions') — 404s anyone the family has restricted.
 *   2. One VIEW grant per ledger, from LEDGER_RESOURCE, added by 20260808000000. It
 *      decides whether the tab is offered AND whether the ledger is fetched. Both
 *      halves matter: props are serialized into the RSC payload and reach the browser
 *      whether a component renders them or not, so hiding a tab over data already
 *      fetched publishes that data (AGENTS.md §5).
 *   3. RLS on every read below, so a member whose `dues` view is scoped to 'own' sees
 *      their own payments and not the family's. This is a SECOND narrowing, not the
 *      same one: gate 2 decides whether the ledger exists for this caller, `dues` and
 *      `transactions/fund-*` decide which rows come back inside it.
 *   4. One RECORDING grant per add button, from the same resource's `create`, resolved
 *      here so the buttons and the server actions can never disagree. All canAny: none
 *      of these records has a coherent "own" version, and the row a member would own —
 *      a payment they record for themselves, a disbursement paying themselves — is
 *      exactly the abuse case.
 *
 * A member with no recording grant sees read-only ledgers, which is the normal case:
 * recording a payment asserts money changed hands, and the person who owes it does not
 * get to make that assertion.
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

  // Which ledgers this caller may see at all. `can`, not `canAny`: a view scoped to
  // 'own' is a real grant — on Contributions and Disbursements it is the RLS predicate
  // that narrows the rows — so it opens the tab and lets the policy do the narrowing.
  const ledgerViews = await Promise.all(
    LEDGERS.map(id => can(user.id, LEDGER_RESOURCE[id], 'view')),
  )
  const visibleLedgers = LEDGERS.filter((_, i) => ledgerViews[i])
  const canSee = (id: Ledger) => visibleLedgers.includes(id)

  // Resolved server-side so the first paint already shows the right ledger, and so
  // the client's initial state matches the server HTML exactly — which is what keeps
  // this free of hydration mismatch. searchParams is a Promise in Next 16.
  //
  // A ledger the caller cannot view — a shared link, or a grant removed since — falls
  // back to the first one they can, the same recovery AdminAccountShell does for a
  // stale ?section=.
  const requestedLedger = resolveLedger((await searchParams).ledger)
  const initialLedger = canSee(requestedLedger)
    ? requestedLedger
    : visibleLedgers[0] ?? requestedLedger

  // One grant per add button. Every one is canAny: none of these four records has a
  // coherent "own" version — a payment you record for YOURSELF and a disbursement
  // paying YOURSELF are the abuse cases, not the safe subset. See AGENTS.md on canAny.
  // There is no delete grant here any more. fund_disbursements is append-only as of
  // 20260807000002 and the resource no longer declares a 'delete' action, so asking for
  // one would resolve a permission nothing can act on.
  //
  // Each ledger's ROWS are fetched only under its own view grant. Skipping the call is
  // the point rather than not rendering it: the result would reach the browser in the
  // RSC payload either way (AGENTS.md §5). The two payment ledgers share one query, so
  // it runs when either is visible and the client splits it by schedule kind.
  const wantPayments = canSee('dues') || canSee('donations')
  const [
    schedules, payments, fundsData, disbursements, contributions,
    canRecordDues, canRecordDonations, canRecordContributions,
    canRecordDisbursements, canReverse,
  ] = await Promise.all([
    getDuesSchedules(),
    wantPayments ? getAllDuesPayments() : [],
    getFunds(),
    canSee('disbursements') ? getAllDisbursements() : [],
    canSee('contributions') ? getFundContributions() : [],
    canAny(user.id, LEDGER_RESOURCE.dues, 'create'),
    canAny(user.id, LEDGER_RESOURCE.donations, 'create'),
    canAny(user.id, LEDGER_RESOURCE.contributions, 'create'),
    canAny(user.id, LEDGER_RESOURCE.disbursements, 'create'),
    canAny(user.id, REVERSAL_RESOURCE, 'create'),
  ])

  // How much of the roster this caller is entitled to see, which is NOT the same as
  // whether a button renders. Props reach the browser whether or not the component
  // renders them, so gating only the affordance would hand every viewer the family's
  // roster in the RSC payload.
  //
  // There is no 'self' tier any more. It existed because dues:edit='own' let a member
  // record their own payment — which is precisely what basic accounting forbids, since
  // it lets the person who owes the money attest that they paid it. Recording is now a
  // treasurer act, so the roster is all-or-nothing.
  const roster: 'all' | 'none' =
    canRecordDues || canRecordDonations || canRecordContributions || canRecordDisbursements
      ? 'all' : 'none'

  // Adults only, matching every other member picker. Family-scoped explicitly: the
  // service-role client does not apply RLS.
  const membersQuery = admin
    .from('people')
    .select('id, first_name, last_name, nick_name, date_of_birth')
    .eq('family_code', familyCode)
    .eq('is_minor', false)
    .not('user_id', 'is', null)
    .order('last_name')

  const [membersResult, milestonesResult, meResult] = await Promise.all([
    roster === 'all' ? membersQuery : Promise.resolve({ data: [] }),
    // Only the disbursement form uses these — gate the FETCH, not just the field.
    canRecordDisbursements
      ? admin.from('fund_milestones').select('*').eq('family_code', familyCode).order('sort_order')
      : Promise.resolve({ data: [] }),
    // The caller's own name, so an optimistically inserted row can say who recorded it
    // without waiting for the refresh. Family-scoped: the service-role client applies no
    // RLS, and a member of two families has a `people` row in each.
    admin.from('people').select('first_name, last_name')
      .eq('user_id', user.id).eq('family_code', familyCode).maybeSingle(),
  ])

  // Schedules drive the payment form's picker; a caller who can record neither kind
  // has no use for them, and they are family configuration.
  const visibleSchedules = canRecordDues || canRecordDonations ? schedules : []

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
        visibleLedgers={visibleLedgers}
        initialPayments={payments}
        initialContributions={contributions}
        initialDisbursements={disbursements}
        schedules={visibleSchedules}
        funds={fundsData.map(f => ({ id: f.id, name: f.name }))}
        milestones={milestonesResult.data ?? []}
        members={members}
        canRecordDues={canRecordDues}
        canRecordDonations={canRecordDonations}
        canRecordContributions={canRecordContributions}
        canRecordDisbursements={canRecordDisbursements}
        canReverse={canReverse}
        myName={[meResult.data?.first_name, meResult.data?.last_name].filter(Boolean).join(' ')}
      />
    </div>
  )
}
