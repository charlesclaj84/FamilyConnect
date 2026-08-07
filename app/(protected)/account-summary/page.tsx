import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyDuesSummary, getMyPaymentHistory, getDonationProgress } from '@/app/actions/dues'
import { DuesDetailSection } from '@/components/account/DuesDetailSection'
import { DonationsSection } from '@/components/account/DonationsSection'
import { resolveSummaryPane } from '@/components/account/summary-panes'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'My Summary — Family Connect' }

export default async function AccountSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'account-summary')

  // Resolved server-side so the first paint already shows the right pane, and so the
  // client's initial state matches the server HTML exactly — which is what keeps this
  // free of hydration mismatch. searchParams is a Promise in Next 16.
  const initialPane = resolveSummaryPane((await searchParams).pane)

  const [duesSummary, paymentHistory, donations] = await Promise.all([
    getMyDuesSummary(),
    getMyPaymentHistory(),
    getDonationProgress(),
  ])

  // No subtitle and no section heading: the page had three lines of chrome saying
  // the same thing (its own title, "My Dues", and two near-identical blurbs) above
  // cards that already name themselves.
  //
  // The ROUTE stays /account-summary. It is the key this page is permissioned by
  // ('account-summary' in permission_resources, and in every group grant referencing
  // it), so renaming the path would orphan those grants to rename a heading.
  return (
    <PageShell className="space-y-8">
      <h1 className="text-3xl font-bold">My Summary</h1>
      {/* Donations are handed in as a slot: DonationsSection is a server component and
          DuesDetailSection is a client one, so it is rendered here and passed down
          rather than imported across the boundary. `hasDonations` goes with it because
          the slot self-hides, and the rail cannot infer that from a rendered child. */}
      <DuesDetailSection
        summary={duesSummary}
        history={paymentHistory}
        donationsSlot={<DonationsSection donations={donations} />}
        hasDonations={donations.length > 0}
        initialPane={initialPane}
      />
    </PageShell>
  )
}
