import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyDuesSummary, getMyPaymentHistory, getDonationProgress } from '@/app/actions/dues'
import { DuesDetailSection } from '@/components/account/DuesDetailSection'
import { DonationsSection } from '@/components/account/DonationsSection'

export const metadata = { title: 'My Summary — Family Connect' }

export default async function AccountSummaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'account-summary')

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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <h1 className="text-3xl font-bold">My Summary</h1>
      {/* Donations are handed in as a slot so they land between Upcoming Dues and
          Payment History. DonationsSection is a server component and DuesDetailSection
          is a client one, so it is rendered here and passed down rather than imported
          across the boundary. Self-hiding when the family has no donations. */}
      <DuesDetailSection
        summary={duesSummary}
        history={paymentHistory}
        donationsSlot={<DonationsSection donations={donations} />}
      />
    </div>
  )
}
