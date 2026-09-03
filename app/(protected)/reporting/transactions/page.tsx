import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { can, canAny, requireView } from '@/lib/auth/permissions'
import { tierAllows } from '@/lib/auth/tier'
import { resolveZone } from '@/lib/auth/zone'
import { getDuesSchedules, getAllDuesPayments } from '@/app/actions/dues'
import { getFunds, getAllDisbursements, getFundContributions, getFundTransfers } from '@/app/actions/funds'
import { TransactionsClient } from '@/components/transactions/TransactionsClient'
import {
  LEDGERS, resolveLedger, LEDGER_RESOURCE, REVERSAL_RESOURCE, type Ledger,
} from '@/components/transactions/ledgers'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./reporting/transactions.title')
}

/**
 * Every transaction the family has recorded: dues in, donations in, contributions
 * into funds, disbursements out, and transfers between one fund and another.
 *
 * NOT an admin page — that was the point of moving it off /admin/account. Four
 * separate gates, because "can see the page", "can see this ledger" and "can move
 * money" are three different questions:
 *
 *   1. requireView('reporting/transactions') — 404s anyone the family has restricted.
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
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'reporting/transactions')

  const { t } = await callerI18n(user.id)

  const admin = createAdminClient()
  const familyCode = await getMyFamilyCode(user.id)

  // Which ledgers this caller may see at all. `can`, not `canAny`: a view scoped to
  // 'own' is a real grant — on Contributions and Disbursements it is the RLS predicate
  // that narrows the rows — so it opens the tab and lets the policy do the narrowing.
  //
  // ── AND `tierAllows`, WHICH IS WHY THIS IS TWO CHECKS AND NOT ONE ──────────────────
  // Added 2026-08-19, when Fund Transfers became a Plus capability on a Free page. It is
  // the `canViewOrganization` shape from `/admin/members`: a page whose grants it resolves
  // by hand owes the tier check by hand, because §1's `requireView` — which folds
  // `requireTier` and `requireFamilyActive` in so no page has to remember them — answers
  // for the PAGE key (`transactions`, Free) and knows nothing about the panes.
  //
  // It is applied to all five rather than to transfers alone, deliberately. Four of them
  // resolve Free through `getFeature()`'s longest-prefix match on `/reporting/transactions`, so the
  // extra term decides nothing for them today — and the next capability sold separately
  // becomes one `tier:` line in `lib/features.ts` rather than an edit here that somebody
  // has to remember to make. A special case for the one ledger that currently differs is
  // how the other four come to be missed.
  //
  // GATING THE FETCH IS THE POINT, NOT THE TAB (§5). `visibleLedgers` is what decides
  // both the rail and every `canSee(...)` query below, so a Free family's request never
  // reads `fund_transfers` at all — a hidden tab over rows already in the RSC payload
  // would have published them.
  const ledgerViews = await Promise.all(
    LEDGERS.map(async id =>
      (await can(user.id, LEDGER_RESOURCE[id], 'view'))
      && (await tierAllows(user.id, LEDGER_RESOURCE[id])),
    ),
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
    schedules, payments, fundsData, disbursements, contributions, transfers,
    canRecordDues, canRecordDonations, canRecordContributions,
    canRecordDisbursements, canRecordTransfers, canReverse, zone,
  ] = await Promise.all([
    getDuesSchedules(),
    wantPayments ? getAllDuesPayments() : [],
    getFunds(),
    canSee('disbursements') ? getAllDisbursements() : [],
    canSee('contributions') ? getFundContributions() : [],
    canSee('transfers') ? getFundTransfers() : [],
    canAny(user.id, LEDGER_RESOURCE.dues, 'create'),
    canAny(user.id, LEDGER_RESOURCE.donations, 'create'),
    canAny(user.id, LEDGER_RESOURCE.contributions, 'create'),
    canAny(user.id, LEDGER_RESOURCE.disbursements, 'create'),
    canAny(user.id, LEDGER_RESOURCE.transfers, 'create'),
    canAny(user.id, REVERSAL_RESOURCE, 'create'),
    resolveZone(user.id),
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
  //
  // canRecordTransfers is deliberately NOT in this list. A transfer names two funds and
  // nobody else — there is no recipient, no giver and no member to pick — so the roster
  // would be PII fetched for a form that has no field to put it in.
  const roster: 'all' | 'none' =
    canRecordDues || canRecordDonations || canRecordContributions || canRecordDisbursements
      ? 'all' : 'none'

  // Balances go to the browser ONLY for someone who may move money, and for the same
  // reason the roster does not go to everyone. The transfer form needs them — it is the
  // one form whose main failure mode is asking for more than a fund holds, and being
  // told that before typing beats being told after. Every other consumer of `funds` on
  // this page wants a name and an id, which is all the prop below carries.
  const transferFunds = canRecordTransfers
    ? fundsData.map(f => ({ id: f.id, name: f.name, balance_cents: f.balance_cents }))
    : []

  // PEOPLE WHO CAN TRANSACT — everyone with an account, and nobody else. Family-scoped
  // explicitly: the service-role client does not apply RLS.
  //
  // This was `.eq('is_minor', false).not('user_id', 'is', null)` until 20260813000006
  // dropped that column, and losing the first conjunct changes nothing: it was false on
  // every row in production, and a person with a `user_id` registered an account, which
  // no minor record ever did. What remains is the conjunct that was always doing the work.
  //
  // The `user_id` test STAYS here while the Directory and the dashboard tile drop it. A
  // money form is the one place where "everyone in the family" is the wrong roster: a
  // record with a generated address cannot pay dues or receive a disbursement, and
  // offering them in the picker invites a payment attributed to somebody who cannot have
  // made it.
  const membersQuery = admin
    .from('people')
    .select('id, first_name, last_name, nick_name, date_of_birth')
    .eq('family_code', familyCode)
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

  // Dues and Donations are two ledgers over ONE table, split by schedule kind — so the
  // single query above answers for both and the rows for a ledger this caller cannot
  // see have to be dropped before they become props. The RLS policy admits the row on
  // EITHER ledger grant (it cannot ask about kind — dues_schedules is gated by
  // admin/account, so a subquery against it returns nothing for most callers; see
  // 20260808000001 §1), which makes this the only place the kind split can be applied
  // correctly.
  //
  // Split on the same test the client uses to fill the two ledgers, so what is dropped
  // here is exactly what the hidden tab would have shown — including the legacy
  // no-schedule rows, which both treat as dues.
  const visiblePayments = payments.filter(p =>
    p.schedule_kind === 'donation' ? canSee('donations') : canSee('dues'),
  )

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

  // `wide` at every width — see the note on the same change in /admin/account. The
  // `xl:max-w-6xl` step this replaces made the page narrower than its neighbours below
  // 1280px for a rail that lives inside the measure rather than beside it.
  return (
    <PageShell className="space-y-8">
      <h1 className="text-3xl font-bold">{t('page./reporting/transactions.title')}</h1>

      <TransactionsClient
        initialLedger={initialLedger}
        zone={zone}
        visibleLedgers={visibleLedgers}
        initialPayments={visiblePayments}
        initialContributions={contributions}
        initialDisbursements={disbursements}
        initialTransfers={transfers}
        schedules={visibleSchedules}
        funds={fundsData.map(f => ({ id: f.id, name: f.name }))}
        transferFunds={transferFunds}
        milestones={milestonesResult.data ?? []}
        members={members}
        canRecordDues={canRecordDues}
        canRecordDonations={canRecordDonations}
        canRecordContributions={canRecordContributions}
        canRecordDisbursements={canRecordDisbursements}
        canRecordTransfers={canRecordTransfers}
        canReverse={canReverse}
        myName={[meResult.data?.first_name, meResult.data?.last_name].filter(Boolean).join(' ')}
      />
    </PageShell>
  )
}
